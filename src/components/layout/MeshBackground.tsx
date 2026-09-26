export function MeshBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-white to-gray-50" />
      <div className="absolute top-0 left-1/4 w-80 h-80 bg-gray-200 rounded-full blur-3xl opacity-10" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-gray-300 rounded-full blur-3xl opacity-10" />
    </div>
  );
}
