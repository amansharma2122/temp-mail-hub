import { Button, type ButtonProps } from "@/components/ui/button";
import { Loader2, Save, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DirtySaveButtonProps extends Omit<ButtonProps, "children"> {
  isDirty: boolean;
  isSaving: boolean;
  label?: string;
  savingLabel?: string;
  savedLabel?: string;
}

/**
 * Standard admin save button:
 * - Disabled when not dirty and not saving
 * - Spinner while saving
 * - "Saved" indicator when clean and not saving
 */
const DirtySaveButton = ({
  isDirty,
  isSaving,
  label = "Save changes",
  savingLabel = "Saving...",
  savedLabel = "Saved",
  className,
  disabled,
  ...rest
}: DirtySaveButtonProps) => {
  const showSaved = !isDirty && !isSaving;
  return (
    <Button
      {...rest}
      disabled={disabled || isSaving || !isDirty}
      className={cn(className)}
    >
      {isSaving ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          {savingLabel}
        </>
      ) : showSaved ? (
        <>
          <Check className="w-4 h-4 mr-2" />
          {savedLabel}
        </>
      ) : (
        <>
          <Save className="w-4 h-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  );
};

export default DirtySaveButton;