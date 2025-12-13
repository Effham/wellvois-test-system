'use client';

import * as React from 'react';
import type { TooltipRenderProps } from 'react-joyride';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function JoyrideShadcnTooltip({
  continuous,
  index,
  size,
  step,
  backProps,
  primaryProps,
  skipProps,
  closeProps,
  tooltipProps,
}: TooltipRenderProps) {
  const isLast = index + 1 === size;

  return (
    <div
      {...tooltipProps}
      // Let the Card own the visual style
      className="pointer-events-auto max-w-sm"
    >
      <Card className="shadow-xl border border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">
              {step?.title ?? 'Quick tip'}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              {...closeProps}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="text-sm leading-6 text-muted-foreground">
          {step?.content}
        </CardContent>

        <CardFooter className="pt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button variant="outline" size="sm" {...backProps}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}
            <Button variant="ghost" size="sm" {...skipProps}>
              Skip
            </Button>
          </div>

          <Button size="sm" {...primaryProps}>
            {continuous ? (
              <>
                {isLast ? 'Done' : 'Next'}
                {!isLast && <ChevronRight className="ml-1 h-4 w-4" />}
              </>
            ) : (
              'Close'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
