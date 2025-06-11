'use server';

/**
 * @fileOverview A flow to generate engaging text for Facebook posts based on WordPress article content.
 *
 * - generateFacebookPost - A function that generates the Facebook post text.
 * - GenerateFacebookPostInput - The input type for the generateFacebookPost function.
 * - GenerateFacebookPostOutput - The return type for the generateFacebookPost function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFacebookPostInputSchema = z.object({
  articleTitle: z.string().describe('The title of the WordPress article.'),
  articleContent: z.string().describe('The main content of the WordPress article.'),
  articleUrl: z.string().url().describe('The URL of the WordPress article.'),
});
export type GenerateFacebookPostInput = z.infer<typeof GenerateFacebookPostInputSchema>;

const GenerateFacebookPostOutputSchema = z.object({
  facebookPostText: z.string().describe('The generated text for the Facebook post.'),
});
export type GenerateFacebookPostOutput = z.infer<typeof GenerateFacebookPostOutputSchema>;

export async function generateFacebookPost(input: GenerateFacebookPostInput): Promise<GenerateFacebookPostOutput> {
  return generateFacebookPostFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFacebookPostPrompt',
  input: {schema: GenerateFacebookPostInputSchema},
  output: {schema: GenerateFacebookPostOutputSchema},
  prompt: `You are an expert social media manager. Your task is to create engaging Facebook post text to accompany a new WordPress article.

  Article Title: {{{articleTitle}}}
  Article Content: {{{articleContent}}}
  Article URL: {{{articleUrl}}}

  Generate compelling and concise Facebook post text that will encourage users to click on the link to read the full article. The Facebook post should be no longer than 280 characters.
  `,
});

const generateFacebookPostFlow = ai.defineFlow(
  {
    name: 'generateFacebookPostFlow',
    inputSchema: GenerateFacebookPostInputSchema,
    outputSchema: GenerateFacebookPostOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
