# Profile Picture & Settings Update - Implementation Summary

## Overview
Implemented custom profile picture upload feature with Gmail photo override capability, reorganized settings with collapsible sections, and added rounded corners to the settings modal.

## Changes Made

### 1. Database Schema Updates
- **Migration: `20251006_add_custom_avatar_url.sql`**
  - Added `custom_avatar_url` column to `user_settings` table
  
- **Migration: `20251006_create_avatars_bucket.sql`**
  - Created Supabase storage bucket `avatars` for profile pictures
  - Configured RLS policies for secure user-specific uploads
  - Enabled public read access for avatar images

### 2. Backend API
- **New Route: `/api/profile/avatar`**
  - `GET`: Fetch user's custom avatar URL
  - `POST`: Upload/update custom avatar URL
  - `DELETE`: Remove custom avatar (revert to provider photo)

### 3. Repository Updates
- **`supabaseRepo.ts`**
  - Added `getCustomAvatarUrl()`: Fetch custom avatar from user_settings
  - Added `setCustomAvatarUrl(url)`: Save/update custom avatar URL

### 4. UI Components

#### AvatarMenu (`src/components/auth/AvatarMenu.tsx`)
- **Avatar Priority Logic**: Custom avatar > provider avatar_url > provider picture
- **Real-time Updates**: Listens for `profile:avatar-updated` events
- **Auto-refresh**: Loads custom avatar on mount and when user changes

#### Settings Sheet (`src/components/settings/SettingsSheet.tsx`)
- **Rounded Corners**: Modal now has `rounded-[25px]` (25px border radius)
- **Collapsible Sections**: 
  - **Appearance** (open by default)
    - Profile Picture Upload with preview
    - Upload button with file validation (5MB max, images only)
    - Remove custom photo button
    - Animated avatar frames selector
  - **Deck Covers** (collapsed by default)
    - Default deck cover selection
    - Preview of selected cover
  - **Accessibility** (collapsed by default, formerly "Audio")
    - Global volume control
    - Correct answer sound
    - Level up sound

#### Profile Picture Upload Features
- **Visual Preview**: Shows current avatar (custom or provider) in 80x80 avatar
- **Upload Button**: Blue primary button with upload icon
- **Remove Button**: Secondary button to delete custom avatar
- **File Validation**:
  - Only image files accepted
  - 5MB maximum file size
  - Supported formats: JPG, PNG, GIF
- **Upload Flow**:
  1. User selects image file
  2. Uploads to Supabase storage (`avatars/{userId}/avatar.{ext}`)
  3. Saves public URL to `user_settings.custom_avatar_url`
  4. Broadcasts `profile:avatar-updated` event
  5. Updates avatar across all components

### 5. User Experience Improvements
- **Collapsible Sections**: Better organization, less scrolling
- **ChevronDown Icons**: Visual indicator for collapsible state
- **Smooth Animations**: Rotate chevron on expand/collapse
- **Persistent State**: Appearance section open by default for quick access
- **Real-time Sync**: Avatar updates immediately across nav and settings

## Technical Implementation Details

### Storage Structure
```
avatars/
  └── {user_id}/
      └── avatar.{ext}  (upserted on each upload)
```

### Event System
- Event: `profile:avatar-updated`
- Detail: `{ avatarUrl: string | null }`
- Listeners: AvatarMenu component

### Avatar Resolution Priority
1. Custom uploaded avatar (`user_settings.custom_avatar_url`)
2. OAuth provider avatar (`user.user_metadata.avatar_url`)
3. OAuth provider picture (`user.user_metadata.picture`)
4. Fallback: User initial letter

## Files Modified
- `src/components/auth/AvatarMenu.tsx`
- `src/components/settings/SettingsSheet.tsx`
- `src/lib/repo/supabaseRepo.ts`

## Files Created
- `src/app/api/profile/avatar/route.ts`
- `supabase/migrations/20251006_add_custom_avatar_url.sql`
- `supabase/migrations/20251006_create_avatars_bucket.sql`

## Security Considerations
- RLS policies ensure users can only upload/modify their own avatars
- File size validation prevents abuse
- File type validation ensures only images are uploaded
- Public bucket for avatars (necessary for display across app)
- User-specific folder structure prevents overwrites

## Testing Checklist
- [ ] Upload profile picture
- [ ] Verify avatar appears in navigation
- [ ] Verify avatar appears in settings
- [ ] Remove custom avatar (should revert to Gmail photo)
- [ ] Test file size validation (try >5MB)
- [ ] Test file type validation (try non-image)
- [ ] Verify settings modal rounded corners
- [ ] Test collapsible sections expand/collapse
- [ ] Verify audio settings moved to Accessibility section
- [ ] Test on different browsers (avatar caching)

## Migration Instructions
1. Run database migrations:
   ```bash
   # Apply custom_avatar_url column
   psql $DATABASE_URL -f supabase/migrations/20251006_add_custom_avatar_url.sql
   
   # Create avatars storage bucket
   psql $DATABASE_URL -f supabase/migrations/20251006_create_avatars_bucket.sql
   ```

2. Verify storage bucket in Supabase dashboard:
   - Navigate to Storage
   - Confirm `avatars` bucket exists
   - Verify RLS policies are active

3. Deploy application with updated code

## Future Enhancements
- [ ] Image cropping/resizing before upload
- [ ] Avatar preview before save
- [ ] Support for multiple avatar sizes
- [ ] Avatar history/rollback
- [ ] Gravatar integration as fallback option
