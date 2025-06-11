'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { addSite, updateSite } from "@/lib/actions";
import type { WordPressSite } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import React, { useState, useEffect } from "react";

const siteFormSchema = z.object({
  name: z.string().min(2, "Site name must be at least 2 characters."),
  url: z.string().url("Please enter a valid WordPress site URL."),
  rssFeedUrl: z.string().url("Please enter a valid RSS feed URL."),
});

type SiteFormValues = z.infer<typeof siteFormSchema>;

interface AddSiteDialogProps {
  site?: WordPressSite | null; 
  children: React.ReactNode; 
  onSiteAddedOrUpdated?: () => void;
}

export function AddSiteDialog({ site, children, onSiteAddedOrUpdated }: AddSiteDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      name: "",
      url: "",
      rssFeedUrl: "",
    },
  });

  useEffect(() => {
    if (site && isOpen) {
      form.reset({
        name: site.name,
        url: site.url,
        rssFeedUrl: site.rssFeedUrl,
      });
    } else if (!site && isOpen) {
      form.reset({ name: "", url: "", rssFeedUrl: "" });
    }
  }, [site, isOpen, form]);

  const onSubmit = async (data: SiteFormValues) => {
    try {
      if (site?.id) {
        await updateSite(site.id, data);
        toast({ title: "Site Updated", description: `${data.name} has been updated successfully.` });
      } else {
        await addSite(data);
        toast({ title: "Site Added", description: `${data.name} has been added successfully.` });
      }
      onSiteAddedOrUpdated?.();
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${site?.id ? 'update' : 'add'} site. Please try again.`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{site ? "Edit Site" : "Add New Site"}</DialogTitle>
          <DialogDescription>
            {site ? "Update the details for this WordPress site." : "Enter the details of the WordPress site you want to monitor."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Minuto24" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WordPress Site URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.minuto24.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rssFeedUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RSS Feed URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.minuto24.com/feed/" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting} className="bg-primary hover:bg-primary/90">
                {form.formState.isSubmitting ? "Saving..." : (site ? "Save Changes" : "Add Site")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
