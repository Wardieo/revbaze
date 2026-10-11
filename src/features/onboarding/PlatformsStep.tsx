import { PlatformPicker } from "../../components/shared/PlatformPicker";
import { usePlan } from "../../hooks/usePlan";
import {
  AnimatePresence,
  motion,
  Reorder,
  useDragControls,
} from "framer-motion";
import { GripVertical, ArrowUp, ArrowDown, X } from "lucide-react";
import { getPlatform } from "../../lib/platforms";
import { validateDestination } from "../../lib/validation";
import { PlatformIcon } from "../../components/shared/PlatformIcon";
import type { ReviewLink } from "../../types/workspace";
import type { OnboardingData } from "./model";
export function PlatformOrder({
  links,
  onChange,
  editable = true,
}: {
  links: ReviewLink[];
  onChange: (links: ReviewLink[]) => void;
  editable?: boolean;
}) {
  return (
    <Reorder.Group
      as="div"
      axis="y"
      values={links}
      onReorder={onChange}
      className="onboard-platform-order"
    >
      <AnimatePresence initial={false}>
        {links.map((link, index) => (
          <Destination
            key={link.id}
            link={link}
            index={index}
            links={links}
            onChange={onChange}
            editable={editable}
          />
        ))}
      </AnimatePresence>
    </Reorder.Group>
  );
}
function Destination({
  link,
  index,
  links,
  onChange,
  editable,
}: {
  link: ReviewLink;
  index: number;
  links: ReviewLink[];
  onChange: (links: ReviewLink[]) => void;
  editable: boolean;
}) {
  const controls = useDragControls();
  const platform = getPlatform(link.platform_id);
  let error = "";
  if (link.destination_url)
    try {
      validateDestination(link.destination_url, link.platform_id);
    } catch (err) {
      error = (err as Error).message;
    }
  const change = (patch: Partial<ReviewLink>) =>
    onChange(links.map((l) => (l.id === link.id ? { ...l, ...patch } : l)));
  const move = (delta: number) => {
    const next = [...links];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  return (
    <Reorder.Item
      as="div"
      value={link}
      dragListener={false}
      dragControls={controls}
      className="onboard-destination"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.2 }}
      layout
    >
      <div className="onboard-destination-heading">
        <button
          type="button"
          className="onboard-grip"
          onPointerDown={(e) => controls.start(e)}
          aria-label={`Drag ${link.display_name || "custom platform"} to reorder`}
        >
          <GripVertical size={16} />
        </button>
        <PlatformIcon id={link.platform_id} />
        <strong>{link.display_name || "Custom platform"}</strong>
        <div className="onboard-order-actions">
          <button
            type="button"
            aria-label={`Move ${link.display_name} up`}
            disabled={index === 0}
            onClick={() => move(-1)}
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            aria-label={`Move ${link.display_name} down`}
            disabled={index === links.length - 1}
            onClick={() => move(1)}
          >
            <ArrowDown size={14} />
          </button>
          {editable && (
            <button
              type="button"
              aria-label={`Remove ${link.display_name}`}
              onClick={() => onChange(links.filter((l) => l.id !== link.id))}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      {editable && (
        <motion.div
          className="stack-form"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          {link.platform_id === "custom" && (
            <label>
              Platform name
              <input
                required
                maxLength={100}
                value={link.display_name}
                onChange={(e) => change({ display_name: e.target.value })}
              />
            </label>
          )}
          <label>
            Official review URL
            <input
              type="url"
              required
              value={link.destination_url}
              placeholder={platform.hint}
              aria-invalid={Boolean(error)}
              aria-describedby={`${link.id}-url-help`}
              onChange={(e) => change({ destination_url: e.target.value })}
            />
            <small
              id={`${link.id}-url-help`}
              className={error ? "onboard-inline-error" : ""}
            >
              {error || `Example: ${platform.hint}`}
            </small>
          </label>
        </motion.div>
      )}
    </Reorder.Item>
  );
}
export function PlatformsStep({
  data,
  update,
}: {
  data: OnboardingData;
  update: (data: OnboardingData) => void;
}) {
  const change = (links: ReviewLink[]) => update({ ...data, links });
  const access = usePlan(null);
  function select(id: string) {
    const existing = data.links.find((l) => l.platform_id === id);
    if (existing && id !== "custom") {
      change(data.links.filter((l) => l.id !== existing.id));
      return;
    }
    if (
      !access.ready ||
      data.links.length >= 20 ||
      (access.plan.linksPerCard !== null &&
        data.links.length >= access.plan.linksPerCard)
    )
      return;
    const date = "";
    change([
      ...data.links,
      {
        id: crypto.randomUUID(),
        business_id: data.business.id,
        platform_id: id,
        display_name: id === "custom" ? "" : getPlatform(id).name,
        destination_url: "",
        is_active: true,
        created_at: date,
        updated_at: date,
      },
    ]);
  }
  return (
    <div>
      {access.isError && (
        <p role="alert" className="onboard-error">
          {access.error?.message}
        </p>
      )}
      <PlatformPicker
        category={data.business.category}
        selected={data.links.map((link) => link.platform_id)}
        onSelect={select}
        multiple
        isDisabled={(id) =>
          !access.ready ||
          ((data.links.length >= 20 ||
            (access.plan.linksPerCard !== null &&
              data.links.length >= access.plan.linksPerCard)) &&
            (id === "custom" ||
              !data.links.some((link) => link.platform_id === id)))
        }
      />
      <p className="onboard-help">
        {access.plan.linksPerCard !== null &&
          `${access.plan.name} allows ${access.plan.linksPerCard} platform links per card. `}
        Select a platform, paste its review URL, then drag to arrange. Arrow
        buttons also change the order.
      </p>
      <AnimatePresence>
        <PlatformOrder links={data.links} onChange={change} />
      </AnimatePresence>
    </div>
  );
}
