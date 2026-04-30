<script lang="ts">
  import { onMount } from "svelte";
  import { getOptions } from "./options";
  import { state } from "./state.svelte";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import Icon from "libs/ui/svelte/components/Icon/Icon.svelte";
  import { Widget } from "@seelen-ui/lib";
  import { t } from "./i18n";
  import { MissingIcon } from "libs/ui/svelte/components/Icon";

  onMount(() => {
    Widget.getCurrent().ready();
  });

  function onCancel() {
    Widget.self.hide();
  }

  const menu = $derived.by(() => {
    if (!state.primaryMonitor) {
      return null;
    }

    const {
      primaryMonitor: { rect, scaleFactor },
    } = state;

    return {
      x: rect.left,
      y: rect.top,
      // we reduce the size and later scale it, to get the correct display by dpi aware
      width: (rect.right - rect.left) / scaleFactor,
      height: (rect.bottom - rect.top) / scaleFactor,
      scale: scaleFactor,
    };
  });

  const layout = $derived(state.powerMenuConfig.layout);
  const options = $derived(getOptions(state.powerMenuConfig.items));
</script>

{#if layout === "Fullscreen"}
  <!-- ── Fullscreen overlay (original behaviour) ── -->
  <div
    class="power-menu-overlay"
    role="menu"
    tabindex="-1"
    onclick={onCancel}
    onkeydown={(e) => {
      if (e.key === "Escape") {
        onCancel();
      }
    }}
  >
    {#if menu}
      <div
        class="power-menu"
        style:position="fixed"
        style:left={menu.x + "px"}
        style:top={menu.y + "px"}
        style:width={menu.width + "px"}
        style:height={menu.height + "px"}
        style:transform={`scale(${menu.scale})`}
        style:transform-origin="left top"
      >
        <div class="power-menu-user">
          {#if state.user.profilePicturePath}
            <img
              class="power-menu-user-profile"
              src={convertFileSrc(state.user.profilePicturePath)}
              alt=""
            />
          {:else}
            <MissingIcon class="power-menu-user-profile" />
          {/if}
          <div class="power-menu-user-email">
            {state.user.email}
          </div>
        </div>
        <div class="power-menu-bye-bye">{$t("goodbye", { 0: state.user.name })}</div>
        <ul class="power-menu-list">
          {#each options as option}
            <li>
              <button onclick={option.onClick} class="power-menu-item">
                <Icon iconName={option.icon as any} />
                <span class="power-menu-item-label">{$t(option.key)}</span>
              </button>
            </li>
          {/each}
        </ul>
        <!-- <div class="power-menu-uptime">{$t("uptime")}: 2 hours 30 minutes</div> -->
      </div>
    {/if}
  </div>
{:else}
  <!-- ── Compact flyout (list or grid) ── -->
  <div
    class="power-menu-flyout"
    class:power-menu-flyout-list={layout === "FlyoutList"}
    class:power-menu-flyout-grid={layout === "FlyoutGrid"}
    role="menu"
    onkeydown={(e) => {
      if (e.key === "Escape") {
        onCancel();
      }
    }}
  >
    <ul class="power-menu-flyout-items">
      {#each options as option}
        <li>
          <button onclick={option.onClick} class="power-menu-flyout-item">
            <Icon iconName={option.icon as any} />
            <span class="power-menu-flyout-item-label">{$t(option.key)}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  :global(body) {
    background-color: transparent;
    overflow: hidden;
  }
</style>
