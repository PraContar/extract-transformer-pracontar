import { useDropzone } from 'react-dropzone';

export function Dropzone({ onFile }: { onFile: (file: File) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    onDrop: (files) => {
      if (files[0]) onFile(files[0]);
    },
  });

  return (
    <div {...getRootProps()} className={`dropzone${isDragActive ? ' active' : ''}`}>
      <input {...getInputProps()} />
      <div className="dz-icon">📄</div>
      <p className="dz-title">Arraste o PDF do extrato aqui</p>
      <p className="dz-sub">ou clique para selecionar</p>
      <p className="dz-note">🔒 Processado 100% no seu navegador — nada é enviado a servidores.</p>
    </div>
  );
}
