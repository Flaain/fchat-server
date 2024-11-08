import { Server } from 'socket.io';
import { GatewayUtils } from './gateway.utils';
import { ChangeUserStatusParams, SocketWithUser, USER_EVENTS, FEED_EVENTS } from './types';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { AppException } from 'src/utils/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';
import { CookiesService } from 'src/utils/services/cookies/cookies.service';
import { ConversationService } from '../conversation/conversation.service';
import { PRESENCE } from '../user/types';
import { AuthService } from '../auth/auth.service';
import { CONVERSATION_EVENTS } from '../conversation/types';

@WebSocketGateway({ cors: { origin: ['http://localhost:4173', 'http://localhost:5173', 'https://fchat-client.vercel.app'], credentials: true } })
export class GatewayService implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    public readonly server: Server;
    private _sockets: Map<string, Array<SocketWithUser>> = new Map();

    constructor(
        private readonly authService: AuthService,
        private readonly conversationService: ConversationService,
        private readonly cookiesService: CookiesService,
    ) {}


    get sockets(): Map<string, Array<SocketWithUser>> {
        return this._sockets;
    }

    set socket({ userId, socket }: { userId: string; socket: SocketWithUser }) {
        const sockets = this.sockets.get(userId);

        this._sockets.set(userId, sockets ? [...sockets, socket] : [socket]);
    }

    private removeSocket = ({ userId, socket }: { userId: string; socket: SocketWithUser }) => {
        const filteredSockets = this.sockets.get(userId).filter((client) => client.id !== socket.id);

        filteredSockets.length ? this._sockets.set(userId, filteredSockets) : this._sockets.delete(userId);
    }

    afterInit(server: Server) {
        server.use(async (socket, next) => {
            try {
                const cookies = socket.handshake.headers.cookie;
    
                if (!cookies) throw new AppException({ message: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
                
                const { accessToken } = this.cookiesService.parseCookies(cookies);

                if (!accessToken) throw new AppException({ message: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);

                const { userId } = this.authService.verifyToken(accessToken, 'access');
                const user = await this.authService.validate(userId);

                socket.data.user = user;

                return next();
            } catch (error) {
                console.log(error);
                return next(error);
            }
        });
    }

    @SubscribeMessage(USER_EVENTS.PRESENCE)
    async changeUserStatus(
        @MessageBody() { presence, lastSeenAt }: ChangeUserStatusParams,
        @ConnectedSocket() client: SocketWithUser,
    ) {
        if (client.data.user.presence === presence) return;

        client.data.user.presence = presence;

        const initiatorId = client.data.user._id;

        const { 0: conversations } = await Promise.all([
            this.conversationService.find({
                filter: { participants: { $in: initiatorId } },
                projection: { participants: 1 },
                options: {
                    populate: [
                        {
                            path: 'participants',
                            model: 'User',
                            select: '_id',
                            match: { _id: { $ne: initiatorId } },
                        },
                    ],
                },
            }),
            client.data.user.updateOne({ presence, lastSeenAt }),
        ]);

        conversations.forEach((conversation) => {
            const recipientId = conversation.participants[0]._id.toString();
            const recipientSockets = this.sockets.get(recipientId);

            recipientSockets?.forEach((socket) => socket.emit(FEED_EVENTS.USER_PRESENCE, { recipientId: initiatorId.toString(), presence }));
            
            client.to(GatewayUtils.getRoomIdByParticipants([initiatorId.toString(), recipientId])).emit(CONVERSATION_EVENTS.PRESENCE, { presence, lastSeenAt });
        });
    }

    handleConnection(client: SocketWithUser) {
        this.socket = { userId: client.data.user._id.toString(), socket: client };
    }

    handleDisconnect(client: SocketWithUser) {
        this.removeSocket({ userId: client.data.user._id.toString(), socket: client });

        !this.sockets.has(client.data.user._id.toString()) && this.changeUserStatus({ presence: PRESENCE.OFFLINE, lastSeenAt: new Date() }, client);
    }
}