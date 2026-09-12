export default function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl font-bold text-slate-300">403</div>
      <h1 className="mt-2 text-lg font-semibold text-slate-700">Access denied</h1>
      <p className="mt-1 text-sm text-slate-500">Aapke role ke paas ye page dekhne ki permission nahi hai.</p>
    </div>
  );
}