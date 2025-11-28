import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Need to create Avatar
import { MoreHorizontal, ThumbsUp, MessageSquare, Repeat, Send } from "lucide-react";
import { markdownToUnicode } from "@/lib/markdownToUnicode";

interface PostPreviewProps {
    content: string;
    mediaUrl?: string;
}

export function PostPreview({ content, mediaUrl }: PostPreviewProps) {
    return (
        <Card className="w-full max-w-md overflow-hidden border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-start space-y-0 p-4 pb-2">
                <div className="flex gap-3">
                    <div className="h-12 w-12 rounded-full bg-slate-200" /> {/* Placeholder for Avatar */}
                    <div>
                        <div className="font-semibold text-sm text-slate-900">Dhaval Nagar</div>
                        <div className="text-xs text-slate-500">Post Scheduler User • 1st</div>
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
                {mediaUrl && (
                    <div className="aspect-video w-full bg-slate-100">
                        {/* Image would go here */}
                        <div className="flex h-full items-center justify-center text-slate-400">Media Preview</div>
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
