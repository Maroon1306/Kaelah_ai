<?php

namespace Drupal\kaelah_ai_connector\Form;

use Drupal\Core\Form\ConfirmFormBase;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Url;

class KaelahDisconnectForm extends ConfirmFormBase {

  public function getFormId() {
    return 'kaelah_ai_connector_disconnect_form';
  }

  public function getQuestion() {
    return $this->t('Déconnecter ce site de Kaelah AI ?');
  }

  public function getCancelUrl() {
    return Url::fromRoute('kaelah_ai_connector.settings');
  }

  public function submitForm(array &$form, FormStateInterface $form_state) {
    $state = \Drupal::state();
    $state->delete('kaelah_ai_connector.access_token');
    $state->delete('kaelah_ai_connector.connected_at');
    $this->messenger()->addStatus($this->t('Ce site a été déconnecté de Kaelah AI.'));
    $form_state->setRedirectUrl($this->getCancelUrl());
  }

}
