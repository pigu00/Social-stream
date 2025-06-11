'use client';

import type { ActivityLog, LogEntryStatus } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Info, Zap, Facebook, ExternalLink, Hourglass, FileText } from "lucide-react";
import { formatDistanceToNow, parseISO } from 'date-fns';

interface ActivityLogTableProps {
  logs: ActivityLog[];
}

const StatusDisplay: React.FC<{ status: LogEntryStatus }> = ({ status }) => {
  switch (status) {
    case 'posted':
      return <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white"><CheckCircle2 className="mr-1 h-3 w-3" /> Posted</Badge>;
    case 'error':
      return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" /> Error</Badge>;
    case 'info':
      return <Badge variant="secondary"><Info className="mr-1 h-3 w-3" /> Info</Badge>;
    case 'generating_post':
      return <Badge variant="outline" className="text-blue-500 border-blue-500"><Hourglass className="mr-1 h-3 w-3 animate-spin" /> Generating</Badge>;
    case 'posting_to_facebook':
      return <Badge variant="outline" className="text-purple-500 border-purple-500"><Facebook className="mr-1 h-3 w-3" /> Posting</Badge>;
    case 'skipped':
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><Zap className="mr-1 h-3 w-3" /> Skipped</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export function ActivityLogTable({ logs }: ActivityLogTableProps) {
  if (!logs || logs.length === 0) {
    return <p className="text-muted-foreground p-4 text-center">No activity logs yet.</p>;
  }

  return (
    <Card className="shadow-md">
    <CardContent className="p-0">
    <ScrollArea className="h-[400px] w-full">
      <Table>
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow>
            <TableHead className="w-[150px]">Timestamp</TableHead>
            <TableHead className="w-[150px]">Site</TableHead>
            <TableHead>Article / Event</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="min-w-[250px]">Details</TableHead>
            <TableHead className="w-[100px] text-center">Links</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} className="hover:bg-muted/50 transition-colors">
              <TableCell className="text-xs text-muted-foreground">
                {formatDistanceToNow(parseISO(log.timestamp), { addSuffix: true })}
              </TableCell>
              <TableCell className="font-medium text-sm">{log.siteName}</TableCell>
              <TableCell className="text-sm">{log.articleTitle || 'System Event'}</TableCell>
              <TableCell>
                <StatusDisplay status={log.status} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-xs">
                 <p className="truncate" title={log.message}>{log.message}</p>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-2">
                {log.articleUrl && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                    <a href={log.articleUrl} target="_blank" rel="noopener noreferrer" title="View Article">
                      <FileText className="h-4 w-4 text-primary" />
                    </a>
                  </Button>
                )}
                {log.facebookPostUrl && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                    <a href={log.facebookPostUrl} target="_blank" rel="noopener noreferrer" title="View Facebook Post">
                      <Facebook className="h-4 w-4 text-blue-600" />
                    </a>
                  </Button>
                )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
    </CardContent>
    </Card>
  );
}

// Added imports for Card and CardContent
import { Card, CardContent } from "@/components/ui/card";
