"use client";

import { useSettings } from "@/hooks/use-settings";
import { useAppStore } from "@/stores/app-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";

export function MaintenanceScreen() {
  const { settings } = useSettings();
  const { setView } = useAppStore();

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
            <Wrench className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold">Under Maintenance</h1>
        <p className="text-muted-foreground">
          {settings?.siteName || "TaskReward"} is currently undergoing maintenance. Please check back soon.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Refresh
        </Button>
      </Card>
    </div>
  );
}
