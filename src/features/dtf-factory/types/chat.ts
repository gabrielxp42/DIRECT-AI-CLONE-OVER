export interface WidgetAction {
    action: 'create_widget' | 'update_widget' | 'trigger_generation';
    aspectRatio?: string;
    prompt?: string;
    garmentMode?: 'black' | 'white' | 'color';
    halftonePreset?: string;
    widthCm?: number;
    heightCm?: number;
    widgetIndex?: number;
    useUploadedImage?: boolean;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    images?: string[]; // base64 data URLs
    actions?: WidgetAction[];
}
