"use client";

import { Chat } from "@/components/Chat";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import { useSessionManager } from "@/hooks/useSessionManager";
import { cn } from "@/lib/utils";
import { useRef } from "react";

interface ChatContainerProps {
	title?: string;
	className?: string;
}

export function ChatContainer({ title, className }: ChatContainerProps) {
	const {
		sessionId,
		initialMessages,
		isLoading,
		handleSessionIdChange,
		startNewChat,
	} = useSessionManager();
	const refreshRef = useRef<number>(1);
	return (
		<div className={cn("flex flex-col w-full", className)}>
			<div className="flex mb-2  items-center justify-between w-full max-w-2xl mx-auto">
				{title && <h1 className="text-xl font-semibold">{title}</h1>}
				<span className="flex-grow" />
				{sessionId && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							startNewChat();
							refreshRef.current++;
						}}
						title="开始新对话"
					>
						<RefreshCcw className="w-4 h-4 mr-2" />
						新对话
					</Button>
				)}
			</div>
			{isLoading ? (
				<div className="flex items-center justify-center w-full h-[80vh]">
					<div className="p-4 text-lg animate-pulse">加载聊天历史...</div>
				</div>
			) : (
				<Chat
					sessionId={sessionId}
					key={refreshRef.current}
					initialMessages={initialMessages}
					onSessionIdChange={handleSessionIdChange}
					className="w-full h-[80vh] sm:h-[70vh] max-h-[700px] shadow-md rounded-md"
				/>
			)}
		</div>
	);
}
