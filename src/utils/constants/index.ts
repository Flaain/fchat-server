import { z } from 'zod';
import { AppException } from '../exceptions/app.exception';
import { PipeTransform } from '@nestjs/common';
import { validateParamId } from '../helpers/validateParamId';

export const paramPipe: PipeTransform = { transform: validateParamId };
export const defaultSuccessResponse = { message: 'OK' };

export const onlyLatinRegExp = /^[a-zA-Z0-9_\s]*$/;
export const allowCyrillicRegExp = /^[\p{L}0-9\s]*$/u;

export const noSearchResults: Pick<AppException, 'message'> = {
    message: 'No results were found for your search',
}

export const otpForSchema = z.string().trim().length(6, 'Invalid OTP code'); 

export const passwordForSchema = z
    .string()
    .trim()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters long')
    .max(32, 'Password must be at most 32 characters long');

export const nameForSchema = z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(32, 'Name must be at most 32 characters long');

export const loginForSchema = z
    .string()
    .trim()
    .min(4, 'Login must be at least 5 characters long')
    .max(32, 'Login must be at most 32 characters long')
    .toLowerCase()
    .regex(onlyLatinRegExp, 'Invalid login. Please use only a-z, 0-9 and underscore characters');

export const messageForSchema = z
    .string()
    .trim()
    .min(1, "Message can't be empty")
    .max(10000, "Message can't be longer than 10000 characters");

export const emailForSchema = z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .toLowerCase();

export const reservedLogins = [
    'fchat',
    'admin',
    'administrator',
    'moderator',
    'root',
    'support',
    'system',
    'owner',
    'info',
    'help',
    'user',
    'test',
    'manager',
    'developer',
    'staff',
    'team',
    'noreply',
    'account',
    'official',
];