// client/src/components/ContactCard.jsx
// Shows the other party's name + phone, with a tap-to-call button.
// Only rendered when the other party's phone is present (i.e. after accept).
import { Phone } from "lucide-react";

function ContactCard({ title, name, phone, role }) {
  if (!phone) return null;

  return (
    <div className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm hover:border-primary/30 transition-colors">
      <p className="text-[11px] font-bold text-base-content/50 uppercase tracking-wider mb-3">
        {title}
      </p>
      
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 grid place-items-center shrink-0 border border-primary/10">
          <span className="font-extrabold text-primary text-base">
            {name?.charAt(0)?.toUpperCase() || "?"}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-base-content text-sm truncate">{name || "—"}</p>
          {role && (
            <p className="text-xs font-medium text-base-content/60 capitalize mt-0.5">{role}</p>
          )}
        </div>
      </div>

      <a
        href={`tel:${phone}`}
        className="mt-4 flex items-center justify-center gap-2 btn btn-sm btn-outline btn-primary w-full rounded-xl shadow-sm hover:shadow"
      >
        <Phone className="w-3.5 h-3.5" /> <span className="font-semibold">{phone}</span>
      </a>
    </div>
  );
}

export default ContactCard;