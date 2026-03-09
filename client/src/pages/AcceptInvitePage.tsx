/**
 * AcceptInvitePage.tsx
 * Supabase redirects here after the invite email is clicked.
 * The user sets their display name and password to complete registration.
 * Place in: src/pages/AcceptInvitePage.tsx
 */
import { useEffect, useState } from "react";
import {
  Box,
  Card,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Alert,
  Stack,
  Loader,
} from "@mantine/core";
import { IconAlertCircle, IconCircleCheck } from "@tabler/icons-react";
import { supabase } from "../lib/supabase";

export function AcceptInvitePage() {
  const [step, setStep] = useState<"loading" | "form" | "done" | "error">(
    "loading",
  );
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<string>("agent");

  useEffect(() => {
    // Supabase puts the session tokens in the URL hash after invite click
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setStep("error");
        return;
      }

      // Pre-fill display_name from the invites table if available
      try {
        const { data } = await supabase
          .from("invites")
          .select("display_name, role")
          .eq("email", session.user.email ?? "")
          .is("used_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (data) {
          setDisplayName(data.display_name ?? "");
          setInviteRole(data.role ?? "agent");
        }
      } catch {
        /* non-critical */
      }

      setStep("form");
    });
  }, []);

  const handleSubmit = async () => {
    if (!displayName.trim()) return setError("Display name is required");
    if (password.length < 8)
      return setError("Password must be at least 8 characters");
    if (password !== confirm) return setError("Passwords do not match");

    setSubmitting(true);
    setError(null);

    // 1. Set password
    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      setError(pwError.message);
      setSubmitting(false);
      return;
    }

    // 2. Create staff_profile row
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Session lost — please request a new invite.");
      setSubmitting(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("staff_profiles")
      .insert({
        id: user.id,
        display_name: displayName.trim(),
        role: inviteRole,
      });

    if (profileError && !profileError.message.includes("duplicate")) {
      setError(profileError.message);
      setSubmitting(false);
      return;
    }

    // 3. Mark invite as used
    await supabase
      .from("invites")
      .update({ used_at: new Date().toISOString() })
      .eq("email", user.email ?? "")
      .is("used_at", null);

    setStep("done");
    setTimeout(() => {
      window.location.href = "/";
    }, 2000);
  };

  if (step === "loading")
    return (
      <Box
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf8f5",
        }}
      >
        <Loader color="#d88626" />
      </Box>
    );

  if (step === "error")
    return (
      <Box
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf8f5",
        }}
      >
        <Card
          p="xl"
          radius="lg"
          style={{ border: "1px solid #f0ebe3", maxWidth: 400, width: "100%" }}
        >
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            title="Invalid invite link"
          >
            This invite link is invalid or has expired. Please ask your admin
            for a new one.
          </Alert>
        </Card>
      </Box>
    );

  if (step === "done")
    return (
      <Box
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf8f5",
        }}
      >
        <Card
          p="xl"
          radius="lg"
          style={{ border: "1px solid #f0ebe3", maxWidth: 400, width: "100%" }}
        >
          <Alert
            icon={<IconCircleCheck size={16} />}
            color="green"
            title="Account created!"
          >
            Welcome aboard. Redirecting you to the dashboard…
          </Alert>
        </Card>
      </Box>
    );

  return (
    <Box
      style={{
        minHeight: "100vh",
        background: "#faf8f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box style={{ width: "100%", maxWidth: 420, padding: "0 16px" }}>
        <Box ta="center" mb="xl">
          <Text
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 36,
              fontWeight: 700,
              color: "#1a1410",
            }}
          >
            Jackson's
          </Text>
          <Text size="sm" c="dimmed" mt={4}>
            You've been invited to the support team
          </Text>
        </Box>

        <Card
          p="xl"
          radius="lg"
          style={{
            border: "1px solid #f0ebe3",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          }}
        >
          <Text
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 20,
              fontWeight: 600,
              color: "#1a1410",
            }}
            mb="lg"
          >
            Set up your account
          </Text>

          {error && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="red"
              mb="md"
              variant="light"
            >
              {error}
            </Alert>
          )}

          <Stack gap="md">
            <TextInput
              label="Your name"
              placeholder="e.g. Alice Smith"
              value={displayName}
              onChange={(e) => setDisplayName(e.currentTarget.value)}
              styles={{
                input: { border: "1px solid #ede7dc", background: "#fdf8f3" },
              }}
            />
            <PasswordInput
              label="Choose a password"
              description="At least 8 characters"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              styles={{
                input: { border: "1px solid #ede7dc", background: "#fdf8f3" },
              }}
            />
            <PasswordInput
              label="Confirm password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              styles={{
                input: { border: "1px solid #ede7dc", background: "#fdf8f3" },
              }}
            />
            <Button
              fullWidth
              mt="xs"
              loading={submitting}
              disabled={
                !displayName.trim() ||
                password.length < 8 ||
                password !== confirm
              }
              onClick={handleSubmit}
              style={{
                background: "linear-gradient(135deg, #d88626, #e8a050)",
                border: "none",
              }}
              radius="md"
            >
              Create account
            </Button>
          </Stack>
        </Card>
      </Box>
    </Box>
  );
}
