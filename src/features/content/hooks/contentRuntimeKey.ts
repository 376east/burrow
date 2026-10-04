import type { ContentRuntimeInput, ContentAcquisitionKind } from '../contentAcquisitionTypes';

export function contentRuntimeKey(runtime: ContentRuntimeInput<ContentAcquisitionKind>) {
  return [
    runtime.instanceId,
    runtime.minecraftVersion ?? '',
    'loader' in runtime ? runtime.loader ?? '' : '',
    'shaderSupport' in runtime ? runtime.shaderSupport : '',
  ].join('\u0000');
}

