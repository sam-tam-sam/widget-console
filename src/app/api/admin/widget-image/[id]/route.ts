import { revalidatePath } from "next/cache";
import { publishAdminChange } from "@/lib/admin-live";
import { getAdminSession, isAdminMutation } from "@/lib/auth";
import { validatedWidgetImage } from "@/lib/widget-image-upload";
import { getInstance, listTemplates, removeWidgetImage, saveWidgetImage, WidgetError } from "@/lib/widgets";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

function result(message: string, status = 200) {
  return Response.json({ message, error: status >= 400 }, { status, headers: { "Cache-Control": "no-store" } });
}

async function changeImage(request: Request, { params }: Context) {
  if (!await getAdminSession()) return result("Sign in to manage widget images.", 401);
  if (!await isAdminMutation()) return result("Open the administration address and try again.", 403);
  const { id } = await params;
  const instance = getInstance(id);
  if (!instance || !listTemplates().some(({ key, imageUpload }) => key === instance.templateKey && imageUpload)) {
    return result("This widget does not accept images.", 404);
  }

  const remove = request.method === "DELETE";
  try {
    if (remove) removeWidgetImage(instance.id);
    else saveWidgetImage(instance.id, await validatedWidgetImage(request));
  } catch (error) {
    if (error instanceof WidgetError) return result(error.message, 400);
    console.error("Widget image update failed", error);
    return result("The image change could not be saved. Try again.", 500);
  }

  revalidatePath(`/admin/widgets/${instance.id}`);
  publishAdminChange("widgets", instance.id);
  return result(remove ? "Image removed." : "Image saved.");
}

export async function POST(request: Request, context: Context) {
  return changeImage(request, context);
}

export async function DELETE(request: Request, context: Context) {
  return changeImage(request, context);
}
