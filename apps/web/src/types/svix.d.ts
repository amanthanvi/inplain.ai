declare module 'svix' {
  export class Webhook {
    constructor(secret: string);
    verify(payload: string | Buffer, headers: Record<string, string | undefined>): any;
  }
  
  export interface WebhookEvent {
    data: any;
    type: string;
  }
}