import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Car, Home, Package } from "lucide-react";
import car from "@/assets/tool-car.jpg";
import home from "@/assets/tool-home.jpg";
import product from "@/assets/tool-product.jpg";
import feed1 from "@/assets/feed-1.jpg";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "Features — Magic Studio" },
      { name: "description", content: "Animate cars, homes and products with AI." },
    ],
  }),
  component: Tools,
});

const features = [
  { img: car, title: "Car Animation", subtitle: "Bring your car shots to life", icon: Car },
  { img: product, title: "Product Animation", subtitle: "Cinematic product ads", icon: Package },
  { img: home, title: "Home Animation", subtitle: "Animate your room or home", icon: Home },
] as const;

function Tools() {
  return (
    <MobileFrame>
      <div className="px-3 pt-3 pb-6 bg-black min-h-full">
        <h1 className="text-center text-[17px] font-semibold text-white mb-5">Features</h1>

        <Link
          to="/trends"
          className="block relative w-full aspect-[16/9] overflow-hidden rounded-2xl bg-neutral-900 mb-5 active:scale-[0.99] transition-transform"
        >
          <img
            src={feed1}
            alt="Country trends"
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute top-2 right-2 size-9 rounded-full bg-black/55 backdrop-blur-sm grid place-items-center text-lg">
            🇦🇲
          </div>
          <div className="absolute bottom-3 left-3 right-3">
            <div className="text-white text-[16px] font-bold leading-tight drop-shadow">Country trends</div>
            <div className="text-white/80 text-[11px] mt-0.5">See what's trending in Armenia</div>
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-x-2.5 gap-y-5">
          {features.map(({ img, title, subtitle, icon: Icon }) => (
            <button
              key={title}
              className="flex flex-col text-left active:scale-[0.98] transition-transform"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-neutral-900">
                <img
                  src={img}
                  alt={title}
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover"
                />
                <div className="absolute bottom-2 left-2 size-9 rounded-full bg-black/55 backdrop-blur-sm grid place-items-center">
                  <Icon className="size-[18px] text-white" strokeWidth={2.2} />
                </div>
              </div>
              <div className="pt-2 px-0.5">
                <div className="text-[15px] font-bold text-white leading-tight">{title}</div>
                <div className="text-[12px] text-neutral-400 mt-1 leading-snug">{subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </MobileFrame>
  );
}
