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
import { connectFacebookPage } from "@/lib/actions";
import type { WordPressSite } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import React, { useState, useEffect } from "react";

const facebookPageFormSchema = z.object({
  pageName: z.string().min(2, "Facebook Page name must be at least 2 characters."),
});

type FacebookPageFormValues = z.infer<typeof facebookPageFormSchema>;

interface ConnectFacebookDialogProps {
  site: WordPressSite;
  children: React.ReactNode; 
  onFacebookPageConnected?: () => void;
}

export function ConnectFacebookDialog({ site, children, onFacebookPageConnected }: ConnectFacebookDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<FacebookPageFormValues>({
    resolver: zodResolver(facebookPageFormSchema),
    defaultValues: {
      pageName: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ pageName: site.facebookPageName || "" });
    }
  }, [isOpen, site.facebookPageName, form]);


  const onSubmit = async (data: FacebookPageFormValues) => {
    try {
      await connectFacebookPage(site.id, data.pageName);
      toast({ title: "Facebook Page Connected", description: `${data.pageName} has been connected to ${site.name}.` });
      onFacebookPageConnected?.();
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect Facebook Page. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Connect Facebook Page</DialogTitle>
          <DialogDescription>
            Enter the name of the Facebook Page to connect to {site.name}.
            In a real app, this would involve Facebook OAuth.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="pageName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Facebook Page Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Minuto24 Oficial" {...field} />
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
                {form.formState.isSubmitting ? "Connecting..." : "Connect Page"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
