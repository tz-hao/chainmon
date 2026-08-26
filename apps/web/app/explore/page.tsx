import { redirect } from "next/navigation";

/** Legacy links now enter the Phaser-first world selector. */
export default function ExplorePage() {
  redirect("/world/select");
}
