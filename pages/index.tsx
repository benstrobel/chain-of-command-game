import { Button, Group, Loader, Text } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { loop } from "../lib/game";
import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";

export default function IndexPage() {
  const [loading, setLoading] = useState(0);
  const [engine, setEngine] = useState<MLCEngine | null>(null);

  useEffect(() => {
    CreateMLCEngine("Llama-3.2-1B-Instruct-q4f16_1-MLC", {
      initProgressCallback: (report) => setLoading(report.progress),
    })
      .then((x) => {
        setEngine(x);
      })
      .catch((x) => console.error(x));
  }, []);

  useEffect(() => {
    if (loading === 1) {
      loop(engine!);
    }
  }, [loading]);

  return (
    <Group mt={50} justify="center">
      {loading < 1 && (
        <Group>
          <Loader />
        </Group>
      )}
      {loading === 1 && <Button size="xl">Game running!</Button>}
    </Group>
  );
}
