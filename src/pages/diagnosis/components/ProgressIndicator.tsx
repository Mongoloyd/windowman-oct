import { PostUploadProgressRail, type PostUploadRailStep } from './PostUploadProgressRail';

interface ProgressIndicatorProps {
  activeStep: PostUploadRailStep;
}

export function ProgressIndicator({ activeStep }: ProgressIndicatorProps) {
  return <PostUploadProgressRail activeStep={activeStep} compact />;
}
