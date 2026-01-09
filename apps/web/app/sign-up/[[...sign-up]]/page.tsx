import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div style={{ display: "grid", placeItems: "center", padding: 24 }}>
      <SignUp />
    </div>
  );
}

