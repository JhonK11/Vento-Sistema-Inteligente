import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { api } from '../../lib/axios';

function imageUrl(path: string): string {
  // Solo medios propios; respeta el prefijo del backend configurado.
  const base = new URL(api.defaults.baseURL || '/api', window.location.href);
  base.pathname = base.pathname.replace(/\/api\/?$/, '') + path;
  base.search = '';
  base.hash = '';
  return base.toString();
}

export default function ProductImage({ src, alt, className = '' }: {
  src: string | null | undefined; alt: string; className?: string;
}) {
  const [fallida, setFallida] = useState<string | null>(null);
  const path = src || '';
  const valida = path.startsWith('/media/productos/') && fallida !== path;
  return valida ? (
    <img src={imageUrl(path)} alt={alt} loading="lazy" decoding="async"
      onError={() => setFallida(path)} className={`object-contain ${className}`} />
  ) : (
    <span role="img" aria-label={`Sin foto: ${alt}`} className={`flex items-center justify-center bg-slate-50 text-slate-300 ${className}`}>
      <ImageOff size={28} />
    </span>
  );
}
