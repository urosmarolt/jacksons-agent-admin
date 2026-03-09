/**
 * LoginPage.tsx
 * Place in: src/pages/LoginPage.tsx
 */
import { useState } from "react";
import {
  Box,
  Card,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Alert,
  Stack,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { supabase } from "../lib/supabase";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(error.message);
    setLoading(false);
    // AuthContext onAuthStateChange handles the redirect automatically
  };

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
      <Box style={{ width: "100%", maxWidth: 400, padding: "0 16px" }}>
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
            Support Admin
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
            Sign in
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
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              styles={{
                input: { border: "1px solid #ede7dc", background: "#fdf8f3" },
              }}
            />
            <PasswordInput
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              styles={{
                input: { border: "1px solid #ede7dc", background: "#fdf8f3" },
              }}
            />
            <Button
              fullWidth
              mt="xs"
              loading={loading}
              disabled={!email.trim() || !password}
              onClick={handleLogin}
              style={{
                background: "linear-gradient(135deg, #d88626, #e8a050)",
                border: "none",
              }}
              radius="md"
            >
              Sign in
            </Button>
          </Stack>
        </Card>

        <Text ta="center" size="xs" c="dimmed" mt="lg">
          Access is by invitation only.
        </Text>
      </Box>
    </Box>
  );
}
