import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MoreHorizontal, ThumbsUp, MessageSquare, Repeat, Send, FileText } from "lucide-react";
import { markdownToUnicode } from "@/lib/markdownToUnicode";

interface Attachment {
    url: string;
    name: string;
    type: string;
    size: number;
}

interface PostPreviewProps {
    content: string;
    attachments?: Attachment[];
}

export function PostPreview({ content, attachments = [] }: PostPreviewProps) {
    const apiBaseUrl = typeof window !== 'undefined'
        ? `http://${window.location.hostname}:5002`
        : 'http://localhost:5002';

    return (
        <Card className="w-full max-w-md overflow-hidden border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-start space-y-0 p-4 pb-2">
                <div className="flex gap-3">
                    <div className="h-12 w-12 rounded-full bg-slate-200" /> {/* Placeholder for Avatar */}
                    <div>
                        <div className="font-semibold text-sm text-slate-900">Your Name</div>
                        <div className="text-xs text-slate-500">DraftFlow User • 1st</div>
                        <div className="text-xs text-slate-500">1h • <span className="text-slate-400">🌐</span></div>
                    </div>
                </div>
                <button className="ml-auto text-slate-500">
                    <MoreHorizontal className="h-5 w-5" />
                </button>
            </CardHeader>
            <CardContent className="p-0">
                <div className="whitespace-pre-wrap px-4 pb-2 text-sm text-slate-900">
                    {markdownToUnicode(content) || "Start typing to preview..."}
                </div>

                {attachments.length > 0 && (
                    <div className="space-y-2 px-4 pb-3">
                        {attachments.map((file, index) => {
                            const isImage = file.type.startsWith('image/');
                            const fullUrl = file.url.startsWith('http') ? file.url : `${apiBaseUrl}${file.url}`;

                            if (isImage) {
                                return (
                                    <div key={index} className="overflow-hidden rounded-lg border border-slate-200">
                                        <img src={fullUrl} alt={file.name} className="w-full h-auto" />
                                    </div>
                                );
                            }

                            return (
                                <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                                    <FileText className="h-8 w-8 text-blue-500" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-slate-900 truncate">{file.name}</div>
                                        <div className="text-xs text-slate-500 truncate">{Math.round(file.size / 1024)} KB • {file.type.split('/')[1].toUpperCase()}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                    <button className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:bg-slate-50 p-2 rounded">
                        <ThumbsUp className="h-4 w-4" /> Like
                    </button>
                    <button className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:bg-slate-50 p-2 rounded">
                        <MessageSquare className="h-4 w-4" /> Comment
                    </button>
                    <button className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:bg-slate-50 p-2 rounded">
                        <Repeat className="h-4 w-4" /> Repost
                    </button>
                    <button className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:bg-slate-50 p-2 rounded">
                        <Send className="h-4 w-4" /> Send
                    </button>
                </div>
            </CardContent>
        </Card>
    );
}
