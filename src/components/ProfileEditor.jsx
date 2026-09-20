import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/ui/use-toast';
import { resolveProfile } from '@/lib/profiles';
import Avatar from '@/components/Avatar';
import { X, ImagePlus, Loader2 } from 'lucide-react';

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

export default function ProfileEditor({ onDone }) {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [existing, setExisting] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!wallet?.address) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const p = await resolveProfile(wallet.address);
      if (!active) return;
      if (p) {
        setExisting(p);
        setDisplayName(p.display_name || '');
        setBio(p.bio || '');
        setAvatarUrl(p.avatar_url || null);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [wallet?.address]);

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) {
      toast({ title: 'Image must be 2MB or smaller', variant: 'destructive' });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (!wallet?.address) {
      toast({ title: 'Connect your wallet first', variant: 'destructive' });
      return;
    }
    if (!displayName.trim()) {
      toast({ title: 'Display name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let finalAvatarUrl = avatarUrl;
      if (imageFile) {
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file: imageFile });
        finalAvatarUrl = file_url;
      }
      const payload = {
        wallet_address: wallet.address,
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: finalAvatarUrl,
      };
      if (existing) {
        await base44.entities.Profile.update(existing.id, payload);
      } else {
        const created = await base44.entities.Profile.create(payload);
        setExisting(created);
      }
      toast({ title: 'Profile saved!' });
      onDone();
    } catch (e) {
      toast({ title: 'Failed to save profile', description: e.message || String(e), variant: 'destructive' });
    }
    setSaving(false);
  };

  if (!wallet) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-white/50">Connect your wallet to create a profile.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">{existing ? 'Edit Profile' : 'Create Profile'}</h2>
        <button onClick={onDone}>
          <X size={20} className="text-white/40" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-[#00ff88]" />
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3 py-2">
            {imagePreview || avatarUrl ? (
              <img
                src={imagePreview || avatarUrl}
                alt="avatar"
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#00ff88]/10 flex items-center justify-center">
                <ImagePlus size={28} className="text-white/30" />
              </div>
            )}
            <label className="cursor-pointer">
              <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              <span className="text-sm text-[#00ff88]">
                {imageFile ? 'Change avatar' : existing?.avatar_url ? 'Change avatar' : 'Upload avatar'}
              </span>
            </label>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. sevensages"
              maxLength={30}
              className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40"
            />
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the community about yourself…"
              rows={3}
              maxLength={200}
              className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 resize-none"
            />
          </div>

          <button
            onClick={save}
            disabled={saving || !displayName.trim()}
            className="w-full py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : existing ? 'Save Changes' : 'Create Profile'}
          </button>
        </>
      )}
    </div>
  );
}