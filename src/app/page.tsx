import { ChatContainer } from "@/components/ChatContainer";
import { client } from "@/lib/fetch";

async function getData() {
  try {
    const res = await client.api.hello.$get();

    if (!res.ok) {
      // This will activate the closest `error.js` Error Boundary
      throw new Error("Failed to fetch data");
    }

    return res.json();
  } catch (error) {
    console.error("获取数据失败:", error);
    return { message: "AI 助手" };
  }
}

export default async function Home() {
  const { message } = await getData();

  return (
    <div className="h-screen  font-[family-name:var(--font-geist-sans)]">
      <ChatContainer title={message} className="w-full " />
    </div>
  );
}
