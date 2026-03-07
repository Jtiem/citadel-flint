import { Heading } from "@/components/ui/Heading";
import { Stack } from "@/components/ui/Layout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginScreen() {
  return (
    <>
      <Heading as={1}>Welcome Back</Heading>
      <Stack direction="vertical" spacing={4}>
        <Input placeholder="Email Address" type="email" />
        <Input placeholder="Password" type="password" />
        <Button variant="primary">Sign In</Button>
      </Stack>
    </>
  );
}
