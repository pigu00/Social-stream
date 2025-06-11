'use client'; 

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { SiteCard } from "@/components/site-management/SiteCard";
import { AddSiteDialog } from "@/components/site-management/AddSiteDialog";
import { ActivityLogTable } from "@/components/activity-log/ActivityLogTable";
import type { WordPressSite, ActivityLog } from "@/lib/types";
import { getSites, getLogs } from "@/lib/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


export default function DashboardPage() {
  const [sites, setSites] = useState<WordPressSite[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoadingSites, setIsLoadingSites] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    // Don't set loading true if it's just a refresh
    if (sites.length === 0) setIsLoadingSites(true);
    if (logs.length === 0) setIsLoadingLogs(true);
    
    try {
      const [sitesData, logsData] = await Promise.all([getSites(), getLogs()]);
      setSites(sitesData);
      setLogs(logsData);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoadingSites(false);
      setIsLoadingLogs(false);
    }
  }, [sites.length, logs.length]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);


  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <section>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-2xl font-semibold font-headline tracking-tight">Monitored WordPress Sites</h1>
          <AddSiteDialog onSiteAddedOrUpdated={fetchDashboardData}>
            <Button variant="default" className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Site
            </Button>
          </AddSiteDialog>
        </div>
        {isLoadingSites ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : sites.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {sites.map((site) => (
              <SiteCard key={site.id} site={site} onSiteUpdated={fetchDashboardData} />
            ))}
          </div>
        ) : (
          <Card className="shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No sites configured yet.</p>
              <AddSiteDialog onSiteAddedOrUpdated={fetchDashboardData}>
                <Button variant="link" className="mt-2">Click here to add your first site</Button>
              </AddSiteDialog>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold font-headline tracking-tight mb-6">Recent Activity</h2>
        {isLoadingLogs ? (
           <div className="space-y-2 p-4 border rounded-md shadow-sm bg-card">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <ActivityLogTable logs={logs} />
        )}
      </section>
    </div>
  );
}

function CardSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-3/4 mb-1" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>
      <CardContent className="flex flex-col sm:flex-row gap-2 justify-between pt-4 border-t bg-muted/30 p-4">
         <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
         </div>
         <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-20" />
         </div>
      </CardContent>
    </Card>
  )
}
