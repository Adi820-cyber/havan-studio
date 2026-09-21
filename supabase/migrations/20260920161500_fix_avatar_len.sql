-- Drop the old constraint that restricted avatars to 8 characters (emojis)
ALTER TABLE public.profiles DROP CONSTRAINT profiles_avatar_len;

-- Add a new constraint that allows longer strings for image URLs/paths (up to 255 characters)
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_len CHECK (char_length(avatar_emoji) between 1 and 255);
