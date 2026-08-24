export interface WhatsAppSendMessageOptions {
  to: string;
  type: 'text' | 'template' | 'image';
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: any[];
  };
  image?: {
    link: string;
    caption?: string;
  };
}

export interface WhatsAppSendMessageResponse {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface WhatsAppIncomingMessage {
  from: string;
  name: string;
  wamid: string;
  timestamp: Date;
  type: 'text' | 'image' | 'button' | 'interactive' | 'unsupported';
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  button?: {
    payload: string;
    text: string;
  };
}

export interface WhatsAppStatusUpdate {
  wamid: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  recipientId: string;
  timestamp: Date;
  errors?: any[];
}
