import { Button, Group } from "@mantine/core";
import { useEffect } from "react";
import { loop } from "../lib/game";

export default function IndexPage() {

  useEffect(() => {
    loop();
  }, [])

  return (
    <Group mt={50} justify="center">
      <Button size="xl">Welcome to Mantine!</Button>
    </Group>
  );
}
