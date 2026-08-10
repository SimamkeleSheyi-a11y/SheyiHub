import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellOff,
  BellRing,
  CheckCircle2,
  KeyRound,
  Mail,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  ShieldCheck,
  Sun,
  User as UserIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Input, TextArea } from "@/components/Input";
import { Skeleton } from "@/components/Skeleton";
import { authApi } from "@/features/auth/api";
import { notificationsApi } from "@/features/notifications/api";
import { useTheme } from "@/hooks/useTheme";
import { ApiError } from "@/lib/apiClient";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import type { NotificationPreferences } from "@/types/notification";
import type { ThemePreference } from "@/types/user";

const themeOptions: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", description: "Always use the light theme.", icon: Sun },
  { value: "dark", label: "Dark", description: "Always use the dark theme.", icon: Moon },
  { value: "system", label: "System", description: "Follow this device's appearance.", icon: Monitor },
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof UserIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine dark:bg-white/10 dark:text-stone-100">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-base font-semibold text-(--text-primary)">{title}</h2>
        <p className="mt-0.5 text-sm text-(--text-secondary)">{description}</p>
      </div>
    </div>
  );
}

function PreferenceRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 border-b border-(--border) py-3.5 last:border-b-0">
      <span>
        <span className="block text-sm font-medium text-(--text-primary)">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-(--text-secondary)">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 shrink-0 accent-ember disabled:cursor-not-allowed"
      />
    </label>
  );
}

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");

  useEffect(() => {
    setDisplayName(user?.display_name ?? "");
    setAvatarUrl(user?.avatar_url ?? "");
    setBio(user?.bio ?? "");
  }, [user?.display_name, user?.avatar_url, user?.bio]);

  const isProfileDirty = useMemo(
    () =>
      displayName.trim() !== (user?.display_name ?? "") ||
      avatarUrl.trim() !== (user?.avatar_url ?? "") ||
      bio.trim() !== (user?.bio ?? ""),
    [displayName, avatarUrl, bio, user?.display_name, user?.avatar_url, user?.bio]
  );

  const updateMutation = useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: (updated) => {
      updateUser(updated);
      toast.success("Profile saved.");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't save your profile.")),
  });

  const resendMutation = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => toast.success("Verification email sent."),
    onError: (error) => toast.error(errorMessage(error, "Couldn't resend the verification email.")),
  });

  const passwordResetMutation = useMutation({
    mutationFn: () => authApi.requestPasswordReset({ email: user?.email ?? "" }),
    onSuccess: () => toast.success("Password reset email sent."),
    onError: (error) => toast.error(errorMessage(error, "Couldn't send the reset email.")),
  });

  const preferencesQuery = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: notificationsApi.preferences,
  });
  const preferencesMutation = useMutation({
    mutationFn: notificationsApi.updatePreferences,
    onSuccess: (updated) => {
      queryClient.setQueryData(["notification-preferences"], updated);
      toast.success("Notification preference updated.");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't update that preference.")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Display name cannot be empty.");
      return;
    }
    updateMutation.mutate({
      display_name: displayName.trim(),
      avatar_url: avatarUrl.trim(),
      bio: bio.trim(),
    });
  }

  function resetProfileForm() {
    setDisplayName(user?.display_name ?? "");
    setAvatarUrl(user?.avatar_url ?? "");
    setBio(user?.bio ?? "");
  }

  function updatePreference(data: Partial<NotificationPreferences>) {
    preferencesMutation.mutate(data);
  }

  async function enableBrowserNotifications() {
    if (!("Notification" in window)) {
      toast.error("This browser doesn't support desktop notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      updatePreference({ browser_enabled: false });
      toast.info("Browser notifications weren't enabled.");
      return;
    }
    updatePreference({ browser_enabled: true });
    toast.success("Browser notifications enabled.");
  }

  const prefs = preferencesQuery.data;
  const browserPermission = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  const memberSince = user?.created_at
    ? new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long" }).format(new Date(user.created_at))
    : null;

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-6 pb-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-(--text-primary)">Settings</h1>
        <p className="mt-1 text-sm text-(--text-secondary)">
          Manage how your SheyiHub profile looks, behaves and notifies you.
        </p>
      </div>

      <Card className="p-5 sm:p-6">
        <SectionTitle
          icon={UserIcon}
          title="Profile"
          description="The details people see when they chat or meet with you."
        />

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-lg border border-(--border) bg-(--surface) p-4 sm:flex-row sm:items-center">
            <Avatar name={displayName} src={avatarUrl} size="xl" className="border-2 border-(--surface-raised) shadow-[var(--shadow-elevation-2)]" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-display text-lg font-semibold text-(--text-primary)">
                  {displayName.trim() || "Your display name"}
                </p>
                <Badge tone={user?.email_verified ? "signal" : "ember"}>
                  {user?.email_verified ? "Verified" : "Email unverified"}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm text-(--text-secondary)">{user?.email}</p>
              {bio.trim() ? (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-(--text-secondary)">{bio.trim()}</p>
              ) : (
                <p className="mt-2 text-sm italic text-(--text-secondary)">Add a short bio to introduce yourself.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Email" value={user?.email ?? ""} disabled hint="Your sign-in email cannot be changed here." />
            <Input
              label="Display name"
              value={displayName}
              maxLength={100}
              autoComplete="name"
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <Input
            label="Avatar URL"
            value={avatarUrl}
            type="url"
            placeholder="https://example.com/avatar.jpg"
            onChange={(e) => setAvatarUrl(e.target.value)}
            hint="Optional. Leave blank to use your initials."
          />

          <div>
            <TextArea
              label="Bio"
              value={bio}
              maxLength={240}
              placeholder="A little about you…"
              onChange={(e) => setBio(e.target.value)}
              hint="Shown on your profile. Keep it short and useful."
            />
            <p className="mt-1 text-right font-mono text-xs text-(--text-secondary)">{bio.length}/240</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-(--border) pt-4">
            <Button type="submit" isLoading={updateMutation.isPending} disabled={!isProfileDirty}>
              Save changes
            </Button>
            {isProfileDirty ? (
              <Button type="button" variant="ghost" onClick={resetProfileForm} disabled={updateMutation.isPending}>
                <RotateCcw className="size-4" aria-hidden /> Reset
              </Button>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-(--text-secondary)">
                <CheckCircle2 className="size-3.5 text-signal" aria-hidden /> Saved
              </span>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionTitle
          icon={Palette}
          title="Appearance"
          description="Choose how SheyiHub looks on this device. Your choice also follows your account."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {themeOptions.map(({ value, label, description, icon: Icon }) => (
            <button
              type="button"
              key={value}
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
              className={cn(
                "flex min-h-28 flex-col items-start rounded-lg border p-4 text-left transition-colors",
                theme === value
                  ? "border-ember bg-ember/10 ring-1 ring-ember"
                  : "border-(--border) hover:bg-stone-100 dark:hover:bg-white/5"
              )}
            >
              <Icon className="mb-3 size-5" aria-hidden />
              <span className="text-sm font-semibold text-(--text-primary)">{label}</span>
              <span className="mt-1 text-xs leading-relaxed text-(--text-secondary)">{description}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionTitle
          icon={BellRing}
          title="Notifications"
          description="Control which collaboration events create alerts for you."
        />
        {preferencesQuery.isError ? (
          <div className="flex flex-col gap-3">
            <ErrorBanner message="Notification preferences couldn't be loaded." />
            <div>
              <Button variant="secondary" size="sm" onClick={() => preferencesQuery.refetch()}>
                Try again
              </Button>
            </div>
          </div>
        ) : preferencesQuery.isPending ? (
          <div className="space-y-3" aria-label="Loading notification preferences">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : prefs ? (
          <div>
            <PreferenceRow
              label="Messages"
              description="Notify me when someone sends me a new message."
              checked={prefs.messages_enabled}
              disabled={preferencesMutation.isPending}
              onChange={(checked) => updatePreference({ messages_enabled: checked })}
            />
            <PreferenceRow
              label="Meetings"
              description="Invitations, RSVP responses and meeting-start alerts."
              checked={prefs.meetings_enabled}
              disabled={preferencesMutation.isPending}
              onChange={(checked) => updatePreference({ meetings_enabled: checked })}
            />
            <PreferenceRow
              label="Files"
              description="Notify me when a participant shares a file."
              checked={prefs.files_enabled}
              disabled={preferencesMutation.isPending}
              onChange={(checked) => updatePreference({ files_enabled: checked })}
            />
            <PreferenceRow
              label="Browser alerts"
              description="Show desktop alerts while SheyiHub is in the background."
              checked={prefs.browser_enabled && browserPermission === "granted"}
              disabled={browserPermission !== "granted" || preferencesMutation.isPending}
              onChange={(checked) => updatePreference({ browser_enabled: checked })}
            />
            {browserPermission !== "granted" ? (
              <Button className="mt-4" variant="secondary" size="sm" onClick={enableBrowserNotifications}>
                {browserPermission === "denied" ? <BellOff className="size-4" /> : <BellRing className="size-4" />}
                {browserPermission === "denied" ? "Browser permission blocked" : "Enable browser notifications"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionTitle
          icon={ShieldCheck}
          title="Account & security"
          description="Review your account status and recover access safely."
        />
        <div className="divide-y divide-(--border)">
          <div className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 size-4.5 shrink-0 text-(--text-secondary)" aria-hidden />
              <div>
                <p className="text-sm font-medium text-(--text-primary)">Email verification</p>
                <p className="mt-0.5 text-xs text-(--text-secondary)">
                  {user?.email_verified
                    ? "Your email is verified and collaboration features are unlocked."
                    : "Verify your email to unlock protected collaboration actions."}
                </p>
              </div>
            </div>
            {user?.email_verified ? (
              <Badge tone="signal">Verified</Badge>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => resendMutation.mutate()}
                isLoading={resendMutation.isPending}
              >
                Resend verification
              </Button>
            )}
          </div>

          <div className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 size-4.5 shrink-0 text-(--text-secondary)" aria-hidden />
              <div>
                <p className="text-sm font-medium text-(--text-primary)">Password</p>
                <p className="mt-0.5 text-xs text-(--text-secondary)">
                  Send a password-reset link to your sign-in email.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => passwordResetMutation.mutate()}
              isLoading={passwordResetMutation.isPending}
            >
              Send reset link
            </Button>
          </div>

          {memberSince ? (
            <div className="flex items-center justify-between gap-4 py-3 text-sm">
              <span className="text-(--text-secondary)">Member since</span>
              <span className="font-medium text-(--text-primary)">{memberSince}</span>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
