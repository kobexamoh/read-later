"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function login(formData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/paste");
}

export async function signup(formData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (error) {
    return { error: error.message };
  }

  // Create default preferences for the new user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.from("user_preferences").insert({
      user_id: user.id,
      interests_text: "",
      mode: "relaxed",
    });
  }

  revalidatePath("/", "layout");
  redirect("/paste");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
