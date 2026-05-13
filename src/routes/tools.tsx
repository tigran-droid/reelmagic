import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import { Car, Home, Package } from "lucide-react";
import car from "@/assets/tool-car.jpg";
import home from "@/assets/tool-home.jpg";
import product from "@/assets/tool-product.jpg";

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
      <div className="px-4 pt-3 pb-6 bg-black min-h-full">
        <h1 className="text-center text-[17px] font-semibold text-white mb-5">Features</h1>
        <div className="grid grid-cols-2 gap-x-3 gap-y-6">
          {features.map(({ img, title, subtitle, icon: Icon }) => (
            <button
              key={title}
              className="flex flex-col text-left active:scale-[0.98] transition-transform"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-neutral-900">
                <img
                  src={img}
                  alt={title}
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover"
                />
                <div className="absolute bottom-2 left-2 size-8 rounded-full bg-black/60 backdrop-blur-sm grid place-items-center">
                  <Icon className="size-4 text-white" strokeWidth={2.4} />
                </div>
              </div>
              <div className="pt-2.5 px-0.5">
                <div className="text-[17px] font-bold text-white leading-tight">{title}</div>
                <div className="text-[13px] text-neutral-400 mt-1 leading-snug">{subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </MobileFrame>
  );
}
