import Image from "next/image";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm rounded-[22px] border border-line bg-white px-5.5 py-6.5">
        <Image src="/icons/icon-192.png" alt="" width={56} height={56} className="mb-3.5 rounded-[15px]" priority />
        <h1 className="mb-1 text-[22px] font-bold">{title}</h1>
        <p className="mb-4.5 text-[14.5px] text-muted">{subtitle}</p>
        {children}
      </div>
    </main>
  );
}
