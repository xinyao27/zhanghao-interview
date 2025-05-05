import { use, Suspense } from "react";

async function getData() {
	const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
		? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
		: "http://localhost:3000";
	const res = await fetch(`${baseUrl}/api/hello`);
	// The return value is *not* serialized
	// You can return Date, Map, Set, etc.

	if (!res.ok) {
		// This will activate the closest `error.js` Error Boundary
		throw new Error("Failed to fetch data");
	}

	return res.json();
}

function MessageContent() {
	const { message } = use(getData());
	return <>{message}</>;
}

export default function Home() {
	return (
		<div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
			<Suspense fallback={<div className="animate-pulse">数据加载中...</div>}>
				<MessageContent />
			</Suspense>
		</div>
	);
}
