import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@atlas/ui";
import { Phone, PhoneOff, Video } from "lucide-react";

export function IncomingCallDialog({ call, isStarting, onAccept, onDecline }) {
  const isVideo = call?.kind === "VIDEO";
  const callerName = call?.initiator?.displayName ?? "Alguien";

  return (
    <Dialog open={Boolean(call)} onOpenChange={(open) => { if (!open) onDecline(); }}>
      <DialogContent size="sm" mobileVariant="center">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/15 text-violet-500">
            {isVideo ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
          </div>
          <DialogTitle className="text-center">{callerName}</DialogTitle>
          <DialogDescription className="text-center">
            {isVideo ? "Videollamada entrante" : "Llamada entrante"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
          <Button type="button" variant="destructive" onClick={onDecline}>
            <PhoneOff className="mr-2 h-4 w-4" />
            Rechazar
          </Button>
          <Button type="button" onClick={onAccept} disabled={isStarting}>
            {isVideo ? <Video className="mr-2 h-4 w-4" /> : <Phone className="mr-2 h-4 w-4" />}
            Contestar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
