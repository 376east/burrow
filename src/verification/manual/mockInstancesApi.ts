import type { InstanceCatalogItemDto, InstanceConfigDto, InstanceListItemDto, InstanceMetadataDto, InstanceMutationResponse, InstanceResult, InstanceSnapshotDto, InstancesAPI } from '@shared/contracts';
import type { Account, ModpackMetadata } from '@shared/types';
import type { ModpackConfig } from '../../contexts/instances/types';

export type ManualState = {
  selectedModpackId: string;
  selectedAccountId: string;
  modpacks: ModpackConfig[];
  metadata: Record<string, ModpackMetadata>;
  accounts: Account[];
};

function findConfig(state: ManualState, modpackId: string) {
  return state.modpacks.find((cfg) => cfg.id === modpackId) ?? null;
}

function updateConfig(state: ManualState, nextConfig: ModpackConfig) {
  state.modpacks = state.modpacks.map((cfg) => (cfg.id === nextConfig.id ? structuredClone(nextConfig) : cfg));
}

function toInstanceConfig(config: ModpackConfig): InstanceConfigDto {
  return {
    runtime: {
      minecraftVersion: config.runtime.minecraft,
      ...(config.runtime.modLoader === undefined ? {} : { modLoader: { ...config.runtime.modLoader } }),
    },
    ...(config.memory === undefined ? {} : { memory: { ...config.memory } }),
    ...(config.vmOptions === undefined ? {} : { vmOptions: [...config.vmOptions] }),
    ...(config.game === undefined ? {} : {
      game: {
        ...(config.game.resolution === undefined ? {} : { resolution: { ...config.game.resolution } }),
        ...(config.game.extraArgs === undefined ? {} : { extraArgs: [...config.game.extraArgs] }),
        ...(config.game.useOptiFine === undefined ? {} : { useOptiFine: config.game.useOptiFine }),
      },
    }),
    ...(config.server === undefined ? {} : { server: { ...config.server } }),
    ...(config.networkMode === undefined ? {} : { networkMode: config.networkMode }),
  };
}

function toModpackConfig(id: string, name: string, config: InstanceConfigDto, metadata?: InstanceMetadataDto): ModpackConfig {
  return {
    id,
    name,
    runtime: {
      minecraft: config.runtime.minecraftVersion,
      ...(config.runtime.modLoader === undefined ? {} : { modLoader: { ...config.runtime.modLoader } }),
    },
    ...(config.memory === undefined ? {} : { memory: { ...config.memory } }),
    ...(config.vmOptions === undefined ? {} : { vmOptions: [...config.vmOptions] }),
    ...(config.game === undefined ? {} : {
      game: {
        ...(config.game.resolution === undefined ? {} : { resolution: { ...config.game.resolution } }),
        ...(config.game.extraArgs === undefined ? {} : { extraArgs: [...config.game.extraArgs] }),
        ...(config.game.useOptiFine === undefined ? {} : { useOptiFine: config.game.useOptiFine }),
      },
    }),
    ...(config.server === undefined ? {} : { server: { ...config.server } }),
    ...(config.networkMode === undefined ? {} : { networkMode: config.networkMode }),
    ...(metadata === undefined ? {} : { createdAt: metadata.createdAt, updatedAt: metadata.updatedAt }),
  };
}

function toInstanceMetadata(metadata: ModpackMetadata): InstanceMetadataDto {
  return {
    source: metadata.source,
    ...(metadata.sourceId === undefined ? {} : { sourceId: metadata.sourceId }),
    ...(metadata.sourceVersionId === undefined ? {} : { sourceVersionId: metadata.sourceVersionId }),
    ...(metadata.version === undefined ? {} : { version: metadata.version }),
    ...(metadata.iconUrl === undefined ? {} : { iconUrl: metadata.iconUrl }),
    ...(metadata.description === undefined ? {} : { description: metadata.description }),
    ...(metadata.author === undefined ? {} : { author: metadata.author }),
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  };
}

function instanceListItems(state: ManualState): InstanceListItemDto[] {
  return state.modpacks.map((config) => ({
    id: config.id,
    name: config.name,
    selected: config.id === state.selectedModpackId,
    summary: {
      minecraftVersion: config.runtime.minecraft,
      ...(config.runtime.modLoader === undefined ? {} : { modLoader: { ...config.runtime.modLoader } }),
    },
  }));
}

function instanceCatalogItems(state: ManualState): InstanceCatalogItemDto[] {
  return state.modpacks.map((config) => ({
    id: config.id,
    name: config.name,
    selected: config.id === state.selectedModpackId,
    summary: {
      minecraftVersion: config.runtime.minecraft,
      ...(config.runtime.modLoader === undefined ? {} : { modLoader: { ...config.runtime.modLoader } }),
    },
    metadata: toInstanceMetadata(state.metadata[config.id]),
  }));
}

function instanceMutation(state: ManualState, status: 'committed' | 'noop' = 'committed'): InstanceMutationResponse {
  return {
    status,
    selectedId: state.selectedModpackId,
    instances: instanceListItems(state),
  };
}

function instanceResult<T>(value: T): InstanceResult<T> {
  return { ok: true, value };
}

function missingInstance<T>(id: string): InstanceResult<T> {
  return {
    ok: false,
    error: {
      code: 'INSTANCE_NOT_FOUND',
      message: `Instance '${id}' was not found in the manual verification fixture.`,
    },
  };
}

export function createManualInstancesApi(state: ManualState): InstancesAPI {
  return {
    list: async () => instanceResult({ status: 'ready', instances: instanceCatalogItems(state) }),
    snapshot: async ({ id }) => {
      const config = findConfig(state, id);
      const metadata = state.metadata[id];
      if (!config || !metadata) return missingInstance<InstanceSnapshotDto>(id);

      return instanceResult({
        id,
        name: config.name,
        metadata: toInstanceMetadata(metadata),
        config: toInstanceConfig(config),
        summary: {
          minecraftVersion: config.runtime.minecraft,
          ...(config.runtime.modLoader === undefined ? {} : { modLoader: { ...config.runtime.modLoader } }),
        },
      });
    },
    select: async ({ id }) => {
      if (!findConfig(state, id)) return missingInstance<InstanceMutationResponse>(id);

      if (state.selectedModpackId === id) return instanceResult(instanceMutation(state, 'noop'));
      state.selectedModpackId = id;
      return instanceResult(instanceMutation(state));
    },
    create: async ({ name, source, config }) => {
      const id = `created-${state.modpacks.length + 1}`;
      const createdAt = new Date().toISOString();
      state.modpacks.push(toModpackConfig(id, name, config, {
        source: source.source,
        ...(source.sourceId === undefined ? {} : { sourceId: source.sourceId }),
        ...(source.sourceVersionId === undefined ? {} : { sourceVersionId: source.sourceVersionId }),
        ...(source.version === undefined ? {} : { version: source.version }),
        ...(source.iconUrl === undefined ? {} : { iconUrl: source.iconUrl }),
        ...(source.description === undefined ? {} : { description: source.description }),
        ...(source.author === undefined ? {} : { author: source.author }),
        createdAt,
        updatedAt: createdAt,
      }));
      state.metadata[id] = {
        id,
        name,
        source: source.source,
        ...(source.sourceId === undefined ? {} : { sourceId: source.sourceId }),
        ...(source.sourceVersionId === undefined ? {} : { sourceVersionId: source.sourceVersionId }),
        ...(source.version === undefined ? {} : { version: source.version }),
        ...(source.iconUrl === undefined ? {} : { iconUrl: source.iconUrl }),
        ...(source.description === undefined ? {} : { description: source.description }),
        ...(source.author === undefined ? {} : { author: source.author }),
        minecraftVersion: config.runtime.minecraftVersion,
        ...(config.runtime.modLoader === undefined ? {} : { modLoader: { ...config.runtime.modLoader } }),
        createdAt,
        updatedAt: createdAt,
      };
      state.selectedModpackId = id;
      return instanceResult(instanceMutation(state));
    },
    rename: async ({ id, name }) => {
      const config = findConfig(state, id);
      const metadata = state.metadata[id];
      if (!config || !metadata) return missingInstance<InstanceMutationResponse>(id);

      updateConfig(state, { ...config, name });
      state.metadata[id] = { ...metadata, name, updatedAt: new Date().toISOString() };
      return instanceResult(instanceMutation(state));
    },
    config: async (request) => {
      const current = findConfig(state, request.id);
      const metadata = state.metadata[request.id];
      if (!current || !metadata) return missingInstance<InstanceConfigDto | InstanceMutationResponse>(request.id);

      if (request.action === 'get') return instanceResult(toInstanceConfig(current));

      updateConfig(state, toModpackConfig(request.id, current.name, request.config, toInstanceMetadata(metadata)));
      state.metadata[request.id] = { ...metadata, updatedAt: new Date().toISOString() };
      return instanceResult(instanceMutation(state));
    },
    metadata: async ({ id }) => {
      const metadata = state.metadata[id];
      return metadata
        ? instanceResult(toInstanceMetadata(metadata))
        : missingInstance<InstanceMetadataDto>(id);
    },
    prepare: async () => instanceResult({ status: 'ready' }),
  };

}
