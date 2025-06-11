'use client';

import type { WordPressSite } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit3, Trash2, Rss, Facebook, Zap, AlertCircle, PauseCircle, PlayCircle, Link as LinkIcon } from "lucide-react";
import { AddSiteDialog } from "./AddSiteDialog";
import { ConnectFacebookDialog } from "./ConnectFacebookDialog";
import { deleteSite, simulateNewArticleAndPost, updateSite } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import React, { useState } from "react";

interface SiteCardProps {
  site: WordPressSite;
  onSiteUpdated: () => void; 
}

export function SiteCard({ site, onSiteUpdated }: SiteCardProps) {
  const { toast } = useToast();
  const [isSimulating, setIsSimulating] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteSite(site.id);
      toast({ title: "Site Deleted", description: `${site.name} has been deleted.` });
      onSiteUpdated();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete site.", variant: "destructive" });
    }
  };
  
  const handleSimulatePost = async () => {
    setIsSimulating(true);
    toast({ title: "Simulating Post...", description: `Attempting to generate and post for ${site.name}.` });
    const result = await simulateNewArticleAndPost(site.id);
    if (result.success) {
      toast({ title: "Simulation Successful", description: result.message });
    } else {
      toast({ title: "Simulation Failed", description: result.message, variant: "destructive" });
    }
    onSiteUpdated(); 
    setIsSimulating(false);
  };

  const toggleMonitoringStatus = async () => {
    const newStatus = site.status === 'monitoring' ? 'paused' : 'monitoring';
    try {
      await updateSite(site.id, { status: newStatus });
      toast({ title: "Status Updated", description: `${site.name} is now ${newStatus}.`});
      onSiteUpdated();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update site status.", variant: "destructive" });
    }
  };

  const getStatusBadgeVariant = (status: WordPressSite['status']) => {
    switch (status) {
      case 'monitoring': return 'default'; 
      case 'paused': return 'secondary';
      case 'error': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: WordPressSite['status']) => {
    switch (status) {
      case 'monitoring': return <PlayCircle className="mr-1 h-3 w-3" />;
      case 'paused': return <PauseCircle className="mr-1 h-3 w-3" />;
      case 'error': return <AlertCircle className="mr-1 h-3 w-3" />;
      default: return null;
    }
  }

  return (
    <Card className="flex flex-col shadow-md hover:shadow-lg transition-shadow duration-300 rounded-lg overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-headline text-lg mb-1">{site.name}</CardTitle>
            <CardDescription className="flex items-center text-xs">
              <Rss className="h-3 w-3 mr-1 text-muted-foreground shrink-0" /> 
              <a href={site.rssFeedUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate text-muted-foreground" title={site.rssFeedUrl}>
                {site.rssFeedUrl.replace(/^https?:\/\//, '')}
              </a>
            </CardDescription>
          </div>
          <Badge variant={getStatusBadgeVariant(site.status)} className="capitalize text-xs py-1 px-2 h-fit shrink-0">
            {getStatusIcon(site.status)}
            {site.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-3 text-sm">
        <div>
          <span className="font-medium">Site URL:</span>{' '}
          <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">
            {site.url} <LinkIcon className="inline h-3 w-3 ml-0.5"/>
          </a>
        </div>
        <div>
          <span className="font-medium">Facebook Page:</span>{' '}
          {site.facebookPageName ? (
            <span className="flex items-center">
              <Facebook className="h-4 w-4 mr-1 text-blue-600" /> {site.facebookPageName}
            </span>
          ) : (
            <span className="text-muted-foreground italic">Not Connected</span>
          )}
        </div>
        {site.status === 'error' && site.errorMessage && (
          <p className="text-xs text-destructive">Error: {site.errorMessage}</p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2 justify-between pt-4 border-t bg-muted/30 p-4">
        <div className="flex flex-wrap gap-2">
           <AddSiteDialog site={site} onSiteAddedOrUpdated={onSiteUpdated}>
            <Button variant="outline" size="sm">
              <Edit3 className="h-4 w-4 mr-1" /> Edit
            </Button>
          </AddSiteDialog>
          <ConnectFacebookDialog site={site} onFacebookPageConnected={onSiteUpdated}>
            <Button variant="outline" size="sm">
              <Facebook className="h-4 w-4 mr-1" /> {site.facebookPageName ? 'Settings' : 'Connect'}
            </Button>
          </ConnectFacebookDialog>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={toggleMonitoringStatus} title={site.status === 'monitoring' ? 'Pause Monitoring' : 'Resume Monitoring'}>
            {site.status === 'monitoring' ? <PauseCircle className="h-4 w-4 mr-1" /> : <PlayCircle className="h-4 w-4 mr-1" />}
            {site.status === 'monitoring' ? 'Pause' : 'Resume'}
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleSimulatePost} 
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={isSimulating}
          >
            <Zap className="h-4 w-4 mr-1" /> {isSimulating ? 'Simulating...' : 'Test Post'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the site "{site.name}" and its configuration.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardFooter>
    </Card>
  );
}
