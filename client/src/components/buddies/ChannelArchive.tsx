import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePolledFetch } from '../../hooks/usePolledFetch';
import { errorText } from './api';
import { CHANNEL_BACKSTOP_MS, setChannelArchived } from './channel-data';
import { channelLinkPath } from './channel-link';
import type { Channel } from './types';

export const archivedChannelsUrl = (workspaceId: string) =>
  `/api/buddies/workspaces/${encodeURIComponent(workspaceId)}/channels/archived`;

export function useArchivedChannels(workspaceId: string) {
  return usePolledFetch<Channel[]>(archivedChannelsUrl(workspaceId), CHANNEL_BACKSTOP_MS);
}

export function ChannelArchiveButton({ channel }: { channel: Channel }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (channel.kind.type !== 'public') return null;
  return (
    <span className="ui-stack">
      <button
        type="button"
        className="ui-control"
        disabled={pending}
        onClick={() => {
          setPending(true);
          setError(null);
          void setChannelArchived(channel.id, !channel.archivedAt)
            .catch((error) => setError(errorText(error)))
            .finally(() => setPending(false));
        }}
      >
        {channel.archivedAt ? 'Restore' : 'Archive'}
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}

export function ArchivedChannels({
  workspaceId,
  channels,
}: { workspaceId: string; channels: readonly Channel[] }) {
  if (!channels.length) return null;
  return (
    <details>
      <summary>Archived channels ({channels.length})</summary>
      <ul className="ui-stack">
        {channels.map((channel) => (
          <li key={channel.id} className="ui-row">
            <Link to={channelLinkPath(workspaceId, { kind: 'channel', channelId: channel.id })}>
              #{channel.kind.type === 'public' ? channel.kind.name : 'channel'}
            </Link>
            <ChannelArchiveButton channel={channel} />
          </li>
        ))}
      </ul>
    </details>
  );
}
