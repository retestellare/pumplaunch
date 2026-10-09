import { ImagePlus } from 'lucide-react';

export const MAX_MEDIA_SIZE = 10 * 1024 * 1024;

export default function NftMediaUpload({ file, preview, onSelect, onError, disabled }) {
  const handleChange = (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (!picked.type.startsWith('image/')) {
      onError('Upload an image or GIF.');
      return;
    }
    if (picked.size > MAX_MEDIA_SIZE) {
      onError('Media must be 10MB or smaller.');
      return;
    }
    onSelect(picked, URL.createObjectURL(picked));
  };

  return (
    <div className="flex items-center gap-3">
      {preview ? (
        <img src={preview} alt="NFT media preview" className="w-20 h-20 rounded-xl object-cover border border-white/5" />
      ) : (
        <div className="w-20 h-20 rounded-xl bg-black/30 border border-white/5 flex items-center justify-center">
          <ImagePlus size={22} className="text-white/30" />
        </div>
      )}
      <label className="flex-1 cursor-pointer">
        <input type="file" accept="image/*" onChange={handleChange} className="hidden" disabled={disabled} />
        <div className="px-3 py-3 bg-black/30 border border-white/5 rounded-xl text-sm text-white/60 text-center hover:bg-white/5 transition">
          {file ? 'Change media' : 'Upload image or GIF'}
        </div>
        <p className="text-[10px] text-white/30 mt-1 text-center">PNG, JPG, GIF or WebP · max 10MB</p>
      </label>
    </div>
  );
}