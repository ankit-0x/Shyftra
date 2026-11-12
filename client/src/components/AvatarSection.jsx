// client/src/components/AvatarSection.jsx
import { useState } from "react";
import { Camera, X, ZoomIn } from "lucide-react";

function AvatarSection({ data, handleAvatarChange }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div>
      {/* --- AVATAR & CAMERA ICON --- */}
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 group">
        
        {/* Photo Area */}
        <div 
          className="w-full h-full rounded-full bg-base-300 text-base-content flex items-center justify-center cursor-pointer overflow-hidden ring-2 ring-base-200 shadow-sm transition-all group-hover:ring-primary/50 relative"
          onClick={() => {
            if (data?.avatarUrl) setIsModalOpen(true);
          }}
        >
          {data?.avatarUrl ? (
            <>
              <img src={data.avatarUrl} alt="avatar" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <ZoomIn className="w-6 h-6" />
              </div>
            </>
          ) : (
            <span className="text-3xl font-extrabold uppercase text-base-content/60">
              {data?.name ? data.name.charAt(0) : "?"}
            </span>
          )}
        </div>

        {/* Camera Button (File Upload) */}
        <label 
          className="absolute bottom-0 right-0 bg-primary text-primary-content p-2 rounded-full cursor-pointer shadow-lg hover:brightness-115 active:scale-95 transition-all z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Camera className="w-4 h-4" />
          <input 
            type="file" 
            accept="image/*" 
            className="hidden"
            onChange={(e) => {
              handleAvatarChange(e);
              e.target.value = null;
            }} 
          />
        </label>
      </div>

      {/* --- FULLSCREEN PHOTO MODAL --- */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-neutral/80 backdrop-blur-md flex items-center justify-center z-110 p-4 animate-fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <div className="relative max-w-lg w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img 
              src={data?.avatarUrl} 
              alt="Full Profile Preview" 
              className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain border border-base-content/10"
            />
            
            <button 
              className="btn btn-sm btn-circle border-green-300 absolute -top-4 -right-4 shadow-lg text-base-content"
              onClick={() => setIsModalOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AvatarSection;