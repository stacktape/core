import dayjs from 'dayjs';
import { generate } from 'short-uuid';

export const generateInvocationId = () => `${dayjs().format('YYYY-MM-DDTHH-mm-ss-SSS')}_${generate()}`;

export const generateShortUuid = generate;
