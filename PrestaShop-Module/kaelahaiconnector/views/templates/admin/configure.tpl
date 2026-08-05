{if $kaelah_error}
  <div class="alert alert-danger">{$kaelah_error|escape:'html':'UTF-8'}</div>
{/if}
{if $kaelah_just_connected}
  <div class="alert alert-success">{l s='Cette boutique est maintenant connectée à Kaelah AI.' mod='kaelahaiconnector'}</div>
{/if}

<div class="panel">
  <div class="panel-heading">
    <i class="icon-plug"></i> {l s='Kaelah AI Connector' mod='kaelahaiconnector'}
  </div>
  <div class="panel-body">
    {if $kaelah_is_connected}
      <p><span class="label label-success">{l s='Connecté à Kaelah AI' mod='kaelahaiconnector'}</span></p>
      {if $kaelah_connected_at}
        <p>{l s='Depuis le' mod='kaelahaiconnector'} {$kaelah_connected_at|escape:'html':'UTF-8'}.</p>
      {/if}
      <p>{l s="Kaelah AI peut désormais lire et optimiser les produits et le SEO de cette boutique depuis son interface, selon les demandes que tu lui feras." mod='kaelahaiconnector'}</p>
      <a href="{$kaelah_disconnect_url|escape:'html':'UTF-8'}" class="btn btn-default" onclick="return confirm('{l s='Déconnecter cette boutique de Kaelah AI ?' mod='kaelahaiconnector'}');">
        {l s='Déconnecter Kaelah AI' mod='kaelahaiconnector'}
      </a>
    {else}
      <p>{l s='Connecte cette boutique à ton compte Kaelah AI en un clic — aucune clé API ni mot de passe à saisir.' mod='kaelahaiconnector'}</p>
      <a href="{$kaelah_connect_url|escape:'html':'UTF-8'}" class="btn btn-primary btn-lg">
        {l s='Connecter à Kaelah AI' mod='kaelahaiconnector'}
      </a>
    {/if}
  </div>
</div>

{if $kaelah_is_connected}
<div class="panel">
  <div class="panel-heading">
    <i class="icon-check-square-o"></i> {l s='Ce que Kaelah AI a appliqué sur cette boutique' mod='kaelahaiconnector'}
  </div>
  <div class="panel-body">
    <table class="table">
      <tbody>
        <tr>
          <td>{l s="SEO page d'accueil" mod='kaelahaiconnector'}</td>
          <td>{if $kaelah_status.homepage_seo_title}✅ {$kaelah_status.homepage_seo_title|escape:'html':'UTF-8'}{else}— {l s='non défini' mod='kaelahaiconnector'}{/if}</td>
        </tr>
        <tr>
          <td>{l s="GEO page d'accueil (paires question/réponse)" mod='kaelahaiconnector'}</td>
          <td>{if $kaelah_status.homepage_geo_qa_count > 0}✅ {$kaelah_status.homepage_geo_qa_count}{else}— {l s='non défini' mod='kaelahaiconnector'}{/if}</td>
        </tr>
        <tr>
          <td>{l s='Produits avec SEO renseigné' mod='kaelahaiconnector'}</td>
          <td>{$kaelah_status.products_with_seo}</td>
        </tr>
        <tr>
          <td>{l s='Produits avec GEO Kaelah' mod='kaelahaiconnector'}</td>
          <td>{$kaelah_status.products_with_geo}</td>
        </tr>
        <tr>
          <td>llms.txt</td>
          <td>
            {if $kaelah_status.llms_txt_published}
              ✅ <a href="{$kaelah_status.llms_txt_url|escape:'html':'UTF-8'}" target="_blank" rel="noopener noreferrer">{$kaelah_status.llms_txt_url|escape:'html':'UTF-8'}</a>
            {else}
              — {l s='non publié' mod='kaelahaiconnector'}
            {/if}
          </td>
        </tr>
        <tr>
          <td>robots.txt</td>
          <td>
            <a href="{$kaelah_status.robots_txt_url|escape:'html':'UTF-8'}" target="_blank" rel="noopener noreferrer">{l s='Voir' mod='kaelahaiconnector'}</a>
            &nbsp;·&nbsp;
            <a href="{$kaelah_sync_robots_url|escape:'html':'UTF-8'}">{l s='Resynchroniser les règles IA' mod='kaelahaiconnector'}</a>
          </td>
        </tr>
      </tbody>
    </table>
    <p><em>{l s="Astuce : clique droit sur une page du site → « Afficher le code source » pour voir le titre SEO, la meta description et les données structurées (JSON-LD) réellement injectés." mod='kaelahaiconnector'}</em></p>
    <p><em>{l s="Le fichier llms.txt nécessite que les URLs conviviales (Préférences > SEO & URLs) soient activées sur cette boutique." mod='kaelahaiconnector'}</em></p>
  </div>
</div>
{/if}
